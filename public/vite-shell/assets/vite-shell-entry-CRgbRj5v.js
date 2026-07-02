//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
var shell_asset_manifest_default = {
	schemaVersion: 4,
	generatedBy: "generate-frontend-shell-manifest",
	shellCacheName: "codex-mobile-shell-v625-a5a3d596240d",
	clientBuildId: "0.1.11|codex-mobile-shell-v625-a5a3d596240d",
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
		"classicGlobalExportAssets": 48,
		"classicGlobalExports": 48,
		"startupGlobalContracts": 30,
		"linkAssets": 4,
		"iconAssets": 4,
		"precacheAssets": 60,
		"pageShellAssets": 61,
		"hashAssets": 60
	}
};
//#endregion
//#region public/build-refresh-policy.js
var require_build_refresh_policy = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexBuildRefreshPolicy = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function normalizeBuildId(value) {
			return String(value || "").trim();
		}
		function shellSequenceFromBuildId(value) {
			const match = normalizeBuildId(value).match(/\bcodex-mobile-shell-v([0-9]+)\b/);
			if (!match) return null;
			const parsed = Number.parseInt(match[1], 10);
			return Number.isSafeInteger(parsed) ? parsed : null;
		}
		function classifyServerBuildChange(serverBuildId, clientBuildId) {
			const server = normalizeBuildId(serverBuildId);
			const client = normalizeBuildId(clientBuildId);
			if (!server || !client || server === client) return "same";
			const serverSeq = shellSequenceFromBuildId(server);
			const clientSeq = shellSequenceFromBuildId(client);
			if (serverSeq !== null && clientSeq !== null) {
				if (serverSeq > clientSeq) return "server-newer";
				if (serverSeq < clientSeq) return "client-newer";
			}
			return "changed";
		}
		function shouldPromptForServerBuildChange(serverBuildId, clientBuildId) {
			const direction = classifyServerBuildChange(serverBuildId, clientBuildId);
			return direction === "server-newer" || direction === "changed";
		}
		return {
			shellSequenceFromBuildId,
			classifyServerBuildChange,
			shouldPromptForServerBuildChange
		};
	});
}));
//#endregion
//#region public/runtime-settings.js
var require_runtime_settings = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexRuntimeSettings = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const MODEL_LABELS = {
			"gpt-5.5": "GPT-5.5",
			"gpt-5.4": "GPT-5.4",
			"gpt-5.4-mini": "GPT-5.4 Mini",
			"gpt-5.3-codex": "GPT-5.3 Codex",
			"gpt-5.3-codex-spark": "GPT-5.3 Codex Spark",
			"gpt-5.2": "GPT-5.2"
		};
		const COMPACT_MODEL_LABELS = {
			"gpt-5.5": "5.5",
			"gpt-5.4": "5.4",
			"gpt-5.4-mini": "5.4 Mini",
			"gpt-5.3-codex": "5.3 Codex",
			"gpt-5.3-codex-spark": "5.3 Spark",
			"gpt-5.2": "5.2"
		};
		const EFFORT_LABELS = {
			low: "Low",
			medium: "Medium",
			high: "High",
			xhigh: "XHigh"
		};
		const PERMISSION_LABELS = {
			default: "默认权限",
			auto: "自动审查",
			full: "完全访问权限",
			custom: "自定义 (config.toml)"
		};
		const PERMISSION_ALIASES = {
			"full-access": "full",
			"workspace-write": "auto",
			"read-only": "auto",
			"auto-review": "auto",
			"auto-reviewing": "auto",
			config: "custom",
			"config.toml": "custom",
			"custom-config": "custom"
		};
		function normalizeOptionList(values) {
			return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
		}
		function labelForModel(value) {
			return MODEL_LABELS[value] || value;
		}
		function compactLabelForModel(value) {
			return COMPACT_MODEL_LABELS[value] || labelForModel(value).replace(/^GPT-/, "");
		}
		function labelForEffort(value) {
			return EFFORT_LABELS[value] || value;
		}
		function labelForPermissionMode(value) {
			return PERMISSION_LABELS[value] || value || "Perm";
		}
		function titleForPermissionMode(value) {
			return PERMISSION_LABELS[value] || "Thread permission";
		}
		function normalizePermissionModeValue(value) {
			const text = String(value || "").trim().toLowerCase();
			return PERMISSION_ALIASES[text] || text;
		}
		function firstRuntimeValue(values) {
			return normalizeOptionList(values)[0] || "";
		}
		function selectedNewThreadModel(settings) {
			return firstRuntimeValue([
				settings && settings.selected,
				settings && settings.defaultValue,
				...settings && settings.options || []
			]);
		}
		function selectedNewThreadEffort(settings) {
			return firstRuntimeValue([
				settings && settings.selected,
				settings && settings.defaultValue,
				...settings && settings.options || []
			]);
		}
		function selectedNewThreadPermission(settings) {
			const normalized = normalizePermissionModeValue(settings && settings.selected);
			if (normalized) return normalized;
			return normalizePermissionModeValue(settings && settings.defaultValue) || normalizePermissionModeValue((settings && settings.options || [])[0]) || "full";
		}
		return {
			normalizeOptionList,
			labelForModel,
			compactLabelForModel,
			labelForEffort,
			labelForPermissionMode,
			titleForPermissionMode,
			normalizePermissionModeValue,
			selectedNewThreadModel,
			selectedNewThreadEffort,
			selectedNewThreadPermission
		};
	});
}));
//#endregion
//#region public/viewport-metrics.js
var require_viewport_metrics = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexViewportMetrics = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_KEYBOARD_SHRINK_PX = 120;
		const DEFAULT_MIN_HEIGHT = 320;
		const DEFAULT_STABLE_PIXEL_EPSILON_PX = 1;
		const NON_TEXT_INPUT_TYPES = /* @__PURE__ */ new Set([
			"button",
			"checkbox",
			"color",
			"file",
			"hidden",
			"image",
			"radio",
			"range",
			"reset",
			"submit"
		]);
		function positiveNumber(value) {
			const numeric = Number(value);
			return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
		}
		function cssPixel(value) {
			const numeric = Number(value);
			return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 0;
		}
		function stablePixelChanged(previous, next, options = {}) {
			const previousPx = cssPixel(previous);
			const nextPx = cssPixel(next);
			const configuredEpsilon = Number(options.epsilonPx);
			const epsilonPx = Math.max(0, Number.isFinite(configuredEpsilon) ? configuredEpsilon : DEFAULT_STABLE_PIXEL_EPSILON_PX);
			if (!previousPx) return Boolean(nextPx);
			if (!nextPx) return Boolean(previousPx);
			return Math.abs(nextPx - previousPx) > epsilonPx;
		}
		function isKeyboardEditable(element) {
			if (!element) return false;
			if (element.isContentEditable) return true;
			const tag = String(element.tagName || "").toLowerCase();
			if (tag === "textarea") return !element.disabled && !element.readOnly;
			if (tag !== "input") return false;
			const type = String(element.type || "text").toLowerCase();
			return !element.disabled && !element.readOnly && !NON_TEXT_INPUT_TYPES.has(type);
		}
		function measureViewport(input = {}) {
			const threshold = positiveNumber(input.keyboardShrinkPx) || DEFAULT_KEYBOARD_SHRINK_PX;
			const minHeight = positiveNumber(input.minHeight) || DEFAULT_MIN_HEIGHT;
			const visual = positiveNumber(input.visualHeight);
			const visualOffsetTop = Math.max(0, Number(input.visualOffsetTop) || 0);
			const scrollTop = Math.max(0, Number(input.scrollTop) || 0);
			const localVisibleTop = Math.max(visualOffsetTop, scrollTop);
			const visualBottom = visual ? visual + visualOffsetTop : 0;
			const layout = Math.max(positiveNumber(input.innerHeight), positiveNumber(input.clientHeight));
			const hostViewportHeight = positiveNumber(input.hostViewportHeight);
			const hostKeyboardBottomInset = Math.max(0, Number(input.hostKeyboardBottomInset) || 0);
			const hostBottomSafeArea = Math.max(0, Number(input.hostBottomSafeArea) || 0);
			const hostKeyboardVisible = Boolean(input.hostKeyboardVisible && hostKeyboardBottomInset > threshold);
			const keyboardCandidate = Boolean(visualBottom && layout && visualBottom < layout - threshold);
			const keyboardInputActive = Boolean(input.keyboardInputActive || isKeyboardEditable(input.activeElement));
			const keyboardShrunk = Boolean(keyboardInputActive && (keyboardCandidate || Boolean(keyboardInputActive && visualOffsetTop > 40) || Boolean(keyboardInputActive && scrollTop > 40) || hostKeyboardVisible));
			const hostKeyboardHeight = hostKeyboardVisible ? Math.max(minHeight, hostViewportHeight || (layout ? layout - hostKeyboardBottomInset : 0)) : 0;
			const localVisualHeight = visual || (visualBottom ? Math.max(0, visualBottom - visualOffsetTop) : 0);
			return {
				height: Math.max(minHeight, Math.round(keyboardShrunk ? hostKeyboardHeight || localVisualHeight || visualBottom || layout || 0 : Math.max(visualBottom || 0, layout || 0))),
				top: Math.round(keyboardShrunk ? localVisibleTop : 0),
				keyboardShrunk,
				keyboardCandidate,
				visualBottom: Math.round(visualBottom),
				layout: Math.round(layout),
				hostKeyboardVisible,
				hostKeyboardBottomInset: Math.round(hostKeyboardBottomInset),
				hostBottomSafeArea: Math.round(hostBottomSafeArea)
			};
		}
		return {
			cssPixel,
			isKeyboardEditable,
			measureViewport,
			stablePixelChanged
		};
	});
}));
//#endregion
//#region public/draft-store.js
var require_draft_store = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexDraftStore = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULTS = {
			draftsKey: "codexMobileDraftsV1",
			draftTargetKey: "codexMobileDraftTargetV1",
			dbName: "codex-mobile-drafts",
			dbVersion: 1,
			attachmentStore: "attachments",
			maxDrafts: 80
		};
		function defaultNormalizeFsPath(value) {
			return String(value || "").replace(/^\\\\\?\\/, "").replace(/[\\/]+/g, "\\").replace(/\\+$/, "").toLowerCase();
		}
		function safeStorage(options) {
			return options && options.storage ? options.storage : null;
		}
		function report(options, type, details) {
			if (options && typeof options.reportError === "function") options.reportError(type, details || {});
		}
		function parseDraftMap(raw) {
			try {
				const value = raw ? JSON.parse(raw) : {};
				return value && typeof value === "object" && !Array.isArray(value) ? value : {};
			} catch (_) {
				return {};
			}
		}
		function normalizeAttachmentMeta(item) {
			if (!item || !item.id || !item.file) return null;
			return {
				id: String(item.id),
				name: String(item.file.name || "upload"),
				type: String(item.file.type || ""),
				size: Number(item.file.size || 0),
				lastModified: Number(item.file.lastModified || 0)
			};
		}
		function draftHasContent(draft) {
			return Boolean(draft && (String(draft.text || "").trim() || Array.isArray(draft.attachments) && draft.attachments.length || draft.model || draft.effort || draft.permissionMode || draft.fastMode === true));
		}
		function attachmentStorageKey(draftKey, attachmentIdValue) {
			return `${encodeURIComponent(draftKey)}|${encodeURIComponent(attachmentIdValue)}`;
		}
		function createDraftStore(options = {}) {
			const config = Object.assign({}, DEFAULTS, options);
			const normalizeFsPath = typeof config.normalizeFsPath === "function" ? config.normalizeFsPath : defaultNormalizeFsPath;
			let dbPromise = null;
			function keyForThread(threadId) {
				const id = String(threadId || "").trim();
				return id ? `thread:${id}` : "";
			}
			function keyForNewThread(cwd) {
				const key = normalizeFsPath(cwd || "");
				return key ? `new:${key}` : "";
			}
			function readMap() {
				const storage = safeStorage(config);
				if (!storage) return {};
				try {
					return parseDraftMap(storage.getItem(config.draftsKey));
				} catch (_) {
					return {};
				}
			}
			function writeMap(map) {
				const storage = safeStorage(config);
				if (!storage) return;
				const entries = Object.entries(map || {}).filter(([, draft]) => draft && typeof draft === "object").sort((a, b) => Number(b[1].updatedAt || 0) - Number(a[1].updatedAt || 0)).slice(0, config.maxDrafts);
				const next = Object.fromEntries(entries);
				try {
					if (entries.length) storage.setItem(config.draftsKey, JSON.stringify(next));
					else storage.removeItem(config.draftsKey);
				} catch (err) {
					report(config, "draft_save_failed", { message: err.message || String(err) });
				}
			}
			function setTargetKey(key) {
				const storage = safeStorage(config);
				if (!storage) return;
				try {
					if (key) storage.setItem(config.draftTargetKey, key);
					else storage.removeItem(config.draftTargetKey);
				} catch (err) {
					report(config, "draft_target_save_failed", { message: err.message || String(err) });
				}
			}
			function getTargetKey() {
				const storage = safeStorage(config);
				if (!storage) return "";
				try {
					return String(storage.getItem(config.draftTargetKey) || "");
				} catch (_) {
					return "";
				}
			}
			function clearTargetKeyIfMatches(key) {
				if (getTargetKey() === String(key || "")) setTargetKey("");
			}
			function openAttachmentDb() {
				const indexedDBRef = config.indexedDB;
				if (!indexedDBRef || typeof indexedDBRef.open !== "function") return Promise.resolve(null);
				if (dbPromise) return dbPromise;
				dbPromise = new Promise((resolve) => {
					const request = indexedDBRef.open(config.dbName, config.dbVersion);
					request.onupgradeneeded = () => {
						const db = request.result;
						const store = db.objectStoreNames.contains(config.attachmentStore) ? request.transaction.objectStore(config.attachmentStore) : db.createObjectStore(config.attachmentStore, { keyPath: "key" });
						if (!store.indexNames.contains("draftKey")) store.createIndex("draftKey", "draftKey", { unique: false });
					};
					request.onsuccess = () => resolve(request.result);
					request.onerror = () => {
						report(config, "draft_db_open_failed", { message: request.error ? request.error.message : "" });
						resolve(null);
					};
					request.onblocked = () => resolve(null);
				});
				return dbPromise;
			}
			async function storeAttachment(draftKey, item) {
				if (!draftKey || !item || !item.id || !item.file) return;
				const db = await openAttachmentDb();
				if (!db) throw new Error("Draft attachment storage unavailable");
				await new Promise((resolve, reject) => {
					const tx = db.transaction(config.attachmentStore, "readwrite");
					tx.objectStore(config.attachmentStore).put({
						key: attachmentStorageKey(draftKey, item.id),
						draftKey,
						id: item.id,
						name: item.file.name || "upload",
						type: item.file.type || "",
						lastModified: item.file.lastModified || Date.now(),
						file: item.file
					});
					tx.oncomplete = resolve;
					tx.onerror = () => reject(tx.error || /* @__PURE__ */ new Error("Draft attachment save failed"));
					tx.onabort = () => reject(tx.error || /* @__PURE__ */ new Error("Draft attachment save aborted"));
				});
			}
			async function loadAttachment(draftKey, meta) {
				const db = await openAttachmentDb();
				if (!db || !draftKey || !meta || !meta.id) return null;
				const record = await new Promise((resolve, reject) => {
					const request = db.transaction(config.attachmentStore, "readonly").objectStore(config.attachmentStore).get(attachmentStorageKey(draftKey, meta.id));
					request.onsuccess = () => resolve(request.result || null);
					request.onerror = () => reject(request.error || /* @__PURE__ */ new Error("Draft attachment read failed"));
				});
				const blob = record && record.file;
				const FileCtor = config.FileCtor;
				if (!blob || typeof FileCtor !== "function") return null;
				const file = blob instanceof FileCtor ? blob : new FileCtor([blob], meta.name || record.name || "upload", {
					type: meta.type || record.type || blob.type || "",
					lastModified: meta.lastModified || record.lastModified || Date.now()
				});
				const urlApi = config.URLApi;
				const previewUrl = file.type && file.type.startsWith("image/") && urlApi && typeof urlApi.createObjectURL === "function" ? urlApi.createObjectURL(file) : "";
				return {
					id: meta.id,
					file,
					previewUrl
				};
			}
			async function deleteAttachments(draftKey, attachmentIds = null) {
				const db = await openAttachmentDb();
				const keyRange = config.IDBKeyRangeCtor;
				if (!db || !draftKey || !keyRange || typeof keyRange.only !== "function") return;
				const ids = attachmentIds ? new Set(Array.from(attachmentIds).map(String)) : null;
				await new Promise((resolve, reject) => {
					const tx = db.transaction(config.attachmentStore, "readwrite");
					const request = tx.objectStore(config.attachmentStore).index("draftKey").openCursor(keyRange.only(draftKey));
					request.onsuccess = () => {
						const cursor = request.result;
						if (!cursor) return;
						if (!ids || ids.has(String(cursor.value && cursor.value.id))) cursor.delete();
						cursor.continue();
					};
					request.onerror = () => reject(request.error || /* @__PURE__ */ new Error("Draft attachment cleanup failed"));
					tx.oncomplete = resolve;
					tx.onerror = () => reject(tx.error || /* @__PURE__ */ new Error("Draft attachment cleanup failed"));
					tx.onabort = () => reject(tx.error || /* @__PURE__ */ new Error("Draft attachment cleanup aborted"));
				});
			}
			return {
				keyForThread,
				keyForNewThread,
				readMap,
				writeMap,
				setTargetKey,
				getTargetKey,
				clearTargetKeyIfMatches,
				hasContent: draftHasContent,
				normalizeAttachmentMeta,
				attachmentStorageKey,
				openAttachmentDb,
				storeAttachment,
				loadAttachment,
				deleteAttachments
			};
		}
		return {
			DEFAULTS,
			defaultNormalizeFsPath,
			parseDraftMap,
			draftHasContent,
			normalizeAttachmentMeta,
			attachmentStorageKey,
			createDraftStore
		};
	});
}));
//#endregion
//#region public/thread-list-load-policy.js
var require_thread_list_load_policy = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadListLoadPolicy = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function bool(value) {
			return value === true;
		}
		function text(value) {
			return String(value || "").trim();
		}
		function planThreadListLoadRequest(input = {}) {
			const silent = bool(input.silent);
			const selectedCwd = text(input.selectedCwd);
			const search = text(input.search);
			const threadDetailOpening = bool(input.threadDetailOpening);
			const documentHidden = bool(input.documentHidden);
			const allowDuringDetail = bool(input.allowDuringDetail);
			const allowHidden = bool(input.allowHidden);
			const hasLoadedList = Number(input.threadListLoadedAtMs || 0) > 0;
			const deferFallback = input.deferFallback;
			const suppressHiddenSilent = silent && documentHidden && !allowHidden;
			const suppressDetailSilent = silent && threadDetailOpening && !allowDuringDetail;
			const allowWarmFallbackInitial = deferFallback !== false && !selectedCwd && !search;
			const shouldDeferFallback = deferFallback === true || silent && deferFallback !== false && threadDetailOpening && !selectedCwd && !search;
			const shouldUseWarmFallbackInitial = allowWarmFallbackInitial && (shouldDeferFallback || !hasLoadedList);
			return {
				action: "thread-list-load-request",
				selectedCwd,
				search,
				silent,
				threadDetailOpening,
				documentHidden,
				shouldLoad: !suppressHiddenSilent && !suppressDetailSilent,
				skipReason: suppressHiddenSilent ? "hidden-silent" : suppressDetailSilent ? "detail-in-flight" : "",
				retryDelayMs: suppressDetailSilent ? 700 : 0,
				shouldDeferFallback,
				shouldUseWarmFallbackInitial,
				params: {
					fallback: shouldDeferFallback ? "defer" : "",
					initial: shouldUseWarmFallbackInitial ? "warm-fallback" : ""
				}
			};
		}
		return { planThreadListLoadRequest };
	});
}));
//#endregion
//#region public/thread-list-stable-order.js
var require_thread_list_stable_order = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadListStableOrder = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_HOLD_MS = 45e3;
		function text(value) {
			return String(value || "").trim();
		}
		function boundedHoldMs(value) {
			const number = Math.trunc(Number(value) || 0);
			if (number <= 0) return DEFAULT_HOLD_MS;
			return Math.min(3e5, Math.max(5e3, number));
		}
		function threadId(thread) {
			return text(thread && thread.id);
		}
		function threadListOrderScopeKey(input = {}) {
			const cwd = text(input.selectedCwd);
			const search = text(input.search).toLowerCase();
			return JSON.stringify({
				cwd,
				search
			});
		}
		function orderedThreadsById(threads, ids) {
			const byId = /* @__PURE__ */ new Map();
			for (const thread of threads || []) {
				const id = threadId(thread);
				if (id && !byId.has(id)) byId.set(id, thread);
			}
			return (ids || []).map((id) => byId.get(id)).filter(Boolean);
		}
		function mergeHeldOrder(previousOrder, incomingIds) {
			const incomingSet = new Set(incomingIds);
			const rank = new Map(incomingIds.map((id, index) => [id, index]));
			const ordered = (previousOrder || []).filter((id) => incomingSet.has(id));
			const orderedSet = new Set(ordered);
			const additions = incomingIds.filter((id) => !orderedSet.has(id));
			for (const id of additions) {
				const idRank = rank.get(id);
				let insertAt = ordered.length;
				for (let index = 0; index < ordered.length; index += 1) if ((rank.get(ordered[index]) ?? Number.MAX_SAFE_INTEGER) > idRank) {
					insertAt = index;
					break;
				}
				ordered.splice(insertAt, 0, id);
				orderedSet.add(id);
			}
			return ordered;
		}
		function planThreadListStableOrder(input = {}) {
			const threads = Array.isArray(input.threads) ? input.threads : [];
			const incomingIds = threads.map(threadId).filter(Boolean);
			const previous = input.previousState && typeof input.previousState === "object" ? input.previousState : {};
			const previousOrder = Array.isArray(previous.order) ? previous.order.map(text).filter(Boolean) : [];
			const scopeKey = text(input.scopeKey) || threadListOrderScopeKey(input);
			const nowMs = Math.max(0, Math.trunc(Number(input.nowMs) || Date.now()));
			const holdMs = boundedHoldMs(input.holdMs);
			const previousHoldUntilMs = Math.max(0, Math.trunc(Number(previous.holdUntilMs) || 0));
			const sameScope = text(previous.scopeKey) === scopeKey;
			const canHold = !input.forceServerOrder && sameScope && previousOrder.length > 0 && previousHoldUntilMs > nowMs;
			const order = canHold ? mergeHeldOrder(previousOrder, incomingIds) : incomingIds;
			const holdUntilMs = canHold ? previousHoldUntilMs : nowMs + holdMs;
			return {
				action: "thread-list-stable-order",
				held: canHold,
				scopeKey,
				holdUntilMs,
				order,
				threads: orderedThreadsById(threads, order),
				state: {
					scopeKey,
					holdUntilMs,
					order
				}
			};
		}
		return {
			DEFAULT_HOLD_MS,
			threadListOrderScopeKey,
			planThreadListStableOrder
		};
	});
}));
//#endregion
//#region public/thread-status-hints.js
var require_thread_status_hints = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadStatusHints = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_RUNNING_HINT_STALE_MS = 1200 * 1e3;
		const DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS = 60 * 1e3;
		const DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS = 1e3;
		function timestampMs(value) {
			if (value === null || value === void 0 || value === "") return 0;
			if (typeof value === "number") {
				if (!Number.isFinite(value) || value <= 0) return 0;
				return value > 0xe8d4a51000 ? Math.trunc(value) : Math.trunc(value * 1e3);
			}
			if (/^\d+(?:\.\d+)?$/.test(String(value))) {
				const numeric = Number(value);
				if (Number.isFinite(numeric) && numeric > 0) return numeric > 0xe8d4a51000 ? Math.trunc(numeric) : Math.trunc(numeric * 1e3);
			}
			const parsed = Date.parse(String(value));
			return Number.isFinite(parsed) ? parsed : 0;
		}
		function statusText(status) {
			if (!status) return "";
			if (typeof status === "string") return status;
			if (status && typeof status === "object" && status.type) return String(status.type);
			try {
				return JSON.stringify(status);
			} catch (_) {
				return String(status);
			}
		}
		function isStaleActiveStatus(status, thread) {
			return Boolean(status && typeof status === "object" && (status.mobileStaleActiveTurn || status.staleActiveTurn || status.reason === "context-only-active-turn") || thread && thread.mobileStaleActiveTurn);
		}
		function isRunningStatus(status) {
			return /active|running|queued|processing|inprogress|in_progress|in-progress|pending|started/.test(statusText(status).toLowerCase());
		}
		function isSettledStatus(status) {
			return /^(idle|notloaded|not_loaded|not-loaded|completed|complete|done|failed|failure|cancelled|canceled|cancel|error|interrupted|stopped|stop)$/.test(statusText(status).toLowerCase());
		}
		function isIdleStatus(status) {
			return /^(idle|notloaded|not_loaded|not-loaded)$/.test(statusText(status).toLowerCase());
		}
		function isTerminalStatus(status) {
			return /^(completed|complete|done|failed|failure|cancelled|canceled|cancel|error|interrupted|stopped|stop)$/.test(statusText(status).toLowerCase());
		}
		function threadUpdatedAtMs(thread) {
			return timestampMs(thread && (thread.updatedAtMs || thread.updatedAt || thread.updated_at_ms || thread.updated_at));
		}
		function terminalTurnAtMs(turn) {
			return timestampMs(turn && turn.completedAtMs) || timestampMs(turn && turn.completedAt) || timestampMs(turn && turn.completed_at_ms) || timestampMs(turn && turn.completed_at) || timestampMs(turn && turn.finishedAt) || timestampMs(turn && turn.finished_at) || timestampMs(turn && turn.updatedAtMs) || timestampMs(turn && turn.updatedAt) || timestampMs(turn && turn.updated_at_ms) || timestampMs(turn && turn.updated_at) || timestampMs(turn && turn.startedAtMs) || timestampMs(turn && turn.startedAt) || timestampMs(turn && turn.started_at_ms) || timestampMs(turn && turn.started_at) || timestampMs(turn && turn.createdAtMs) || timestampMs(turn && turn.createdAt) || timestampMs(turn && turn.created_at_ms) || timestampMs(turn && turn.created_at);
		}
		function notificationDurableEventAtMs(params = {}) {
			return timestampMs(params.eventAtMs) || timestampMs(params.eventAt) || terminalTurnAtMs(params.turn) || timestampMs(params.receivedAtMs) || timestampMs(params.timestampMs) || timestampMs(params.timestamp);
		}
		function notificationEventAtMs(params = {}, fallbackMs = 0, options = {}) {
			const durableAt = notificationDurableEventAtMs(params);
			if (durableAt) return durableAt;
			if (options.allowReplayReceivedAt !== false) {
				const replayAt = timestampMs(params.mobileReplayReceivedAtMs);
				if (replayAt) return replayAt;
			}
			return timestampMs(params.receivedAtMs) || timestampMs(params.timestampMs) || timestampMs(params.timestamp) || timestampMs(fallbackMs);
		}
		function latestTerminalTurn(thread) {
			const turns = Array.isArray(thread && thread.turns) ? thread.turns : [];
			const latest = turns.length ? turns[turns.length - 1] : null;
			if (!latest) return null;
			return isTerminalStatus(latest.status) ? latest : null;
		}
		function latestTerminalTurnAtMs(thread) {
			const turn = latestTerminalTurn(thread);
			return turn ? terminalTurnAtMs(turn) : 0;
		}
		function hasFreshSubmittedProcessingHint(submittedProcessingHintedAtMs, nowMs, staleMs = DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS) {
			const hintedAt = timestampMs(submittedProcessingHintedAtMs);
			const now = timestampMs(nowMs) || Date.now();
			return Boolean(hintedAt > 0 && now - hintedAt <= Math.max(0, Number(staleMs) || DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS));
		}
		function statusFreshnessAtMs(thread, eventAtMs) {
			return Math.max(threadUpdatedAtMs(thread) || 0, timestampMs(eventAtMs) || 0);
		}
		function settledStatusFreshEnoughForRunningHint(input = {}) {
			const hintedAt = timestampMs(input.runningHintedAtMs);
			if (!hintedAt) return true;
			const statusAt = statusFreshnessAtMs(input.thread, input.eventAtMs);
			if (!statusAt) return false;
			if (input.mobileReplay) return statusAt >= hintedAt;
			return statusAt + Math.max(0, Number(input.freshnessToleranceMs) || DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS) >= hintedAt;
		}
		function shouldKeepRunningHintForSettledStatus(input = {}) {
			const threadId = String(input.threadId || "");
			if (!threadId || !input.isRunningHinted) return false;
			const status = input.status || input.thread && input.thread.status;
			if (isStaleActiveStatus(status, input.thread)) return false;
			if (!isSettledStatus(status)) return false;
			if (isIdleStatus(status) && !latestTerminalTurn(input.thread) && !input.eventIsTerminal) return true;
			if (input.allowLocalProcessing !== false && isIdleStatus(status) && !latestTerminalTurn(input.thread) && hasFreshSubmittedProcessingHint(input.submittedProcessingHintedAtMs, input.nowMs, input.submittedProcessingHintStaleMs)) return true;
			if (input.currentThreadId && threadId === String(input.currentThreadId) && input.currentThreadSettled) return false;
			if (input.currentThreadHasLiveTurn) return true;
			if (!input.mobileReplay && (isTerminalStatus(status) || latestTerminalTurn(input.thread) || input.eventIsTerminal)) return false;
			return !settledStatusFreshEnoughForRunningHint(input);
		}
		function threadUnreadTerminalAtMs(thread, eventAtMs = 0, options = {}) {
			const eventAt = options.eventIsTerminal ? timestampMs(eventAtMs) : 0;
			return Math.max(latestTerminalTurnAtMs(thread) || 0, eventAt || 0);
		}
		function shouldMarkThreadUnread(input = {}) {
			const threadId = String(input.threadId || "");
			if (!threadId || threadId === String(input.currentThreadId || "")) return false;
			const status = input.status || input.thread && input.thread.status;
			if (isStaleActiveStatus(status, input.thread)) return false;
			if (!isSettledStatus(status)) return false;
			if (isIdleStatus(status) && !latestTerminalTurn(input.thread) && !input.eventIsTerminal) return false;
			const terminalAt = threadUnreadTerminalAtMs(input.thread, input.eventAtMs, { eventIsTerminal: Boolean(input.eventIsTerminal) });
			const viewedAt = timestampMs(input.viewedAtMs);
			if (viewedAt > 0) return terminalAt > viewedAt;
			const updateAt = terminalAt || (input.wasRunning ? statusFreshnessAtMs(input.thread, input.eventAtMs) : 0);
			if (input.mobileReplay && !updateAt) return false;
			const hintedAt = timestampMs(input.runningHintedAtMs);
			if (!input.wasRunning || hintedAt <= 0) return false;
			if (!updateAt) return !input.mobileReplay;
			return updateAt + (input.mobileReplay ? 0 : Math.max(0, Number(input.freshnessToleranceMs) || DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS)) >= hintedAt;
		}
		function runningHintAgeMs(input = {}) {
			const hintedAt = timestampMs(input.runningHintedAtMs);
			const now = timestampMs(input.nowMs) || Date.now();
			if (hintedAt > 0) return now - hintedAt;
			const updatedAt = threadUpdatedAtMs(input.thread);
			if (updatedAt > 0) return now - updatedAt;
			return (Number(input.runningHintStaleMs) || DEFAULT_RUNNING_HINT_STALE_MS) + 1;
		}
		function shouldExpireRunningThreadHint(input = {}) {
			if (!input.threadId || !input.isRunningHinted) return false;
			const status = input.status || input.thread && input.thread.status;
			if (isStaleActiveStatus(status, input.thread)) return true;
			if (isRunningStatus(status)) return false;
			if (isSettledStatus(status) && !shouldKeepRunningHintForSettledStatus(input)) return false;
			if (input.currentThreadHasLiveTurn) return false;
			return runningHintAgeMs(input) > (Number(input.runningHintStaleMs) || DEFAULT_RUNNING_HINT_STALE_MS);
		}
		return {
			DEFAULT_RUNNING_HINT_STALE_MS,
			DEFAULT_SUBMITTED_PROCESSING_HINT_STALE_MS,
			DEFAULT_STATUS_EVENT_FRESHNESS_TOLERANCE_MS,
			hasFreshSubmittedProcessingHint,
			isIdleStatus,
			isRunningStatus,
			isSettledStatus,
			isStaleActiveStatus,
			isTerminalStatus,
			latestTerminalTurnAtMs,
			notificationDurableEventAtMs,
			notificationEventAtMs,
			runningHintAgeMs,
			shouldExpireRunningThreadHint,
			shouldKeepRunningHintForSettledStatus,
			shouldMarkThreadUnread,
			statusFreshnessAtMs,
			statusText,
			terminalTurnAtMs,
			threadUpdatedAtMs,
			timestampMs
		};
	});
}));
//#endregion
//#region public/thread-detail-patch-plan.js
var require_thread_detail_patch_plan = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadDetailPatchPlan = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function normalizePatchEntry(entry) {
			if (!entry || typeof entry !== "object") return null;
			const key = String(entry.key || "");
			if (!key) return null;
			return Object.assign({}, entry, { key });
		}
		function normalizeRefreshTurnPatchEntry(entry) {
			if (!entry || typeof entry !== "object") return null;
			const key = String(entry.key || "");
			if (!key) return null;
			return {
				key,
				hasPreviousTurn: Boolean(entry.hasPreviousTurn),
				itemPatchable: Boolean(entry.itemPatchable),
				articlePresent: Boolean(entry.articlePresent)
			};
		}
		function normalizedStringList(value) {
			return Array.isArray(value) ? value.map((entry) => String(entry || "")).filter(Boolean) : [];
		}
		function signatureText(signature) {
			if (signature == null) return "";
			if (typeof signature === "string") return signature;
			try {
				return JSON.stringify(signature);
			} catch (_) {
				return "";
			}
		}
		function planThreadDetailDomPatchSurface(input = {}) {
			const threadId = String(input.threadId || "").trim();
			const threadTileMode = Boolean(input.threadTileMode);
			const threadTileSurface = Boolean(input.threadTileSurface);
			const tilePaneVisible = Boolean(input.tilePaneVisible);
			const conversationPresent = Boolean(input.conversationPresent);
			if (threadTileMode || threadTileSurface) {
				if (!threadTileMode) return {
					canPatch: false,
					surface: "blocked",
					reason: "tile-surface-without-tile-mode",
					threadId
				};
				if (!threadTileSurface) return {
					canPatch: false,
					surface: "blocked",
					reason: "tile-mode-surface-mismatch",
					threadId
				};
				if (!threadId) return {
					canPatch: false,
					surface: "thread-tile-pane",
					reason: "missing-thread-id",
					threadId: ""
				};
				if (!tilePaneVisible) return {
					canPatch: false,
					surface: "thread-tile-pane",
					reason: "tile-pane-not-visible",
					threadId
				};
				return {
					canPatch: true,
					surface: "thread-tile-pane",
					reason: "tile-pane-visible",
					threadId
				};
			}
			if (!conversationPresent) return {
				canPatch: false,
				surface: "single-thread",
				reason: "missing-conversation",
				threadId
			};
			return {
				canPatch: true,
				surface: "single-thread",
				reason: "single-thread-surface",
				threadId
			};
		}
		function planThreadDetailRefreshLocalPatchPreflight(input = {}) {
			const conversationPresent = Boolean(input.conversationPresent);
			const previousThreadPresent = Boolean(input.previousThreadPresent);
			const nextThreadPresent = Boolean(input.nextThreadPresent);
			if (!conversationPresent) return {
				canPatch: false,
				terminal: false,
				reason: "missing-conversation-root"
			};
			if (!previousThreadPresent || !nextThreadPresent) return {
				canPatch: false,
				terminal: false,
				reason: "missing-thread"
			};
			if (String(input.stage || "complete") === "root") return {
				canPatch: true,
				terminal: false,
				reason: "root-ready"
			};
			if (input.tilePanePatched) return {
				canPatch: true,
				terminal: true,
				reason: "tile-pane-patched"
			};
			if (!input.singleThreadSurfaceAvailable) return {
				canPatch: false,
				terminal: false,
				reason: "single-thread-surface-unavailable"
			};
			if (input.previousLoadingOrError || input.nextLoadingOrError) return {
				canPatch: false,
				terminal: false,
				reason: "loading-or-error-state"
			};
			const renderedConversationSignature = signatureText(input.renderedConversationSignature);
			const previousConversationSignature = signatureText(input.previousConversationSignature);
			const renderedPatchShellSignature = signatureText(input.renderedPatchShellSignature);
			const previousPatchShellSignature = signatureText(input.previousPatchShellSignature);
			const nextPatchShellSignature = signatureText(input.nextPatchShellSignature);
			if (renderedConversationSignature !== previousConversationSignature && (!renderedPatchShellSignature || renderedPatchShellSignature !== previousPatchShellSignature)) return {
				canPatch: false,
				terminal: false,
				reason: "rendered-dom-stale"
			};
			if (previousPatchShellSignature !== nextPatchShellSignature) return {
				canPatch: false,
				terminal: false,
				reason: "patch-shell-changed"
			};
			return {
				canPatch: true,
				terminal: false,
				reason: "preflight-passed"
			};
		}
		function visibleItemPatchShapePreservesExisting(previousEntries, nextEntries) {
			if (!Array.isArray(previousEntries) || !Array.isArray(nextEntries)) return false;
			const previous = previousEntries.map(normalizePatchEntry).filter(Boolean);
			const next = nextEntries.map(normalizePatchEntry).filter(Boolean);
			if (previous.length !== previousEntries.length || next.length !== nextEntries.length) return false;
			if (previous.length > next.length) return false;
			let previousIndex = 0;
			for (const nextEntry of next) {
				const previousEntry = previous[previousIndex];
				if (previousEntry && previousEntry.key === nextEntry.key) previousIndex += 1;
			}
			return previousIndex === previous.length;
		}
		function planVisibleItemRefreshPatch(previousEntries, nextEntries) {
			if (!visibleItemPatchShapePreservesExisting(previousEntries, nextEntries)) return {
				canPatch: false,
				reason: "shape-changed",
				operations: []
			};
			const previousByKey = new Map(previousEntries.map(normalizePatchEntry).filter(Boolean).map((entry) => [entry.key, entry]));
			const operations = [];
			for (const rawNextEntry of nextEntries) {
				const nextEntry = normalizePatchEntry(rawNextEntry);
				if (!nextEntry) return {
					canPatch: false,
					reason: "invalid-entry",
					operations: []
				};
				const previousEntry = previousByKey.get(nextEntry.key);
				if (!previousEntry) {
					operations.push({
						type: "insert",
						key: nextEntry.key,
						nextEntry
					});
					continue;
				}
				const previousSignature = signatureText(previousEntry.signature);
				const nextSignature = signatureText(nextEntry.signature);
				operations.push({
					type: previousSignature === nextSignature ? "reuse" : "patch",
					key: nextEntry.key,
					previousEntry,
					nextEntry
				});
			}
			return {
				canPatch: true,
				reason: "shape-preserved",
				operations
			};
		}
		function planThreadDetailRefreshDomPatch(entries, options = {}) {
			if (!Array.isArray(entries)) return {
				canPatch: false,
				reason: "invalid-turn-entries",
				operations: []
			};
			const operations = [];
			const nextKeys = /* @__PURE__ */ new Set();
			for (const rawEntry of entries) {
				const entry = normalizeRefreshTurnPatchEntry(rawEntry);
				if (!entry) return {
					canPatch: false,
					reason: "invalid-turn-entry",
					operations: []
				};
				nextKeys.add(entry.key);
				if (entry.hasPreviousTurn && entry.itemPatchable && entry.articlePresent) {
					operations.push({
						type: "item-patch",
						key: entry.key,
						entry
					});
					continue;
				}
				operations.push({
					type: entry.articlePresent ? "replace-turn" : "insert-turn",
					key: entry.key,
					entry
				});
			}
			const previousTurnKeys = normalizedStringList(options.previousTurnKeys || options.previousKeys);
			for (const previousKey of previousTurnKeys) {
				if (nextKeys.has(previousKey)) continue;
				operations.push({
					type: "remove-turn",
					key: previousKey,
					entry: {
						key: previousKey,
						stale: true
					}
				});
			}
			return {
				canPatch: true,
				reason: "planned",
				operations
			};
		}
		return {
			normalizePatchEntry,
			normalizeRefreshTurnPatchEntry,
			planThreadDetailRefreshDomPatch,
			planThreadDetailRefreshLocalPatchPreflight,
			planVisibleItemRefreshPatch,
			planThreadDetailDomPatchSurface,
			visibleItemPatchShapePreservesExisting
		};
	});
}));
//#endregion
//#region public/thread-detail-merge-state.js
var require_thread_detail_merge_state = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexThreadDetailMergeState = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		function defaultNormalizeThread(thread) {
			return thread;
		}
		function defaultSortTurns(turns) {
			return Array.isArray(turns) ? turns.slice() : [];
		}
		function createThreadDetailMergePolicy(options = {}) {
			const isV4ProjectionThread = typeof options.isV4ProjectionThread === "function" ? options.isV4ProjectionThread : () => false;
			const mergeV4ProjectionThread = typeof options.mergeV4ProjectionThread === "function" ? options.mergeV4ProjectionThread : (existingThread, incomingThread) => incomingThread || existingThread || null;
			const normalizeThreadVisibleUserMessages = typeof options.normalizeThreadVisibleUserMessages === "function" ? options.normalizeThreadVisibleUserMessages : defaultNormalizeThread;
			const turnVisibleWeight = typeof options.turnVisibleWeight === "function" ? options.turnVisibleWeight : () => 0;
			const shouldPreserveExistingTurnVisibleItems = typeof options.shouldPreserveExistingTurnVisibleItems === "function" ? options.shouldPreserveExistingTurnVisibleItems : () => false;
			const mergeItemsPreservingLocalVisible = typeof options.mergeItemsPreservingLocalVisible === "function" ? options.mergeItemsPreservingLocalVisible : (existingItems, incomingItems) => Array.isArray(incomingItems) ? incomingItems : existingItems;
			const shouldDropInitialSubmissionEchoTurn = typeof options.shouldDropInitialSubmissionEchoTurn === "function" ? options.shouldDropInitialSubmissionEchoTurn : () => false;
			const turnIsSupersededBy = typeof options.turnIsSupersededBy === "function" ? options.turnIsSupersededBy : () => false;
			const isTurnComplete = typeof options.isTurnComplete === "function" ? options.isTurnComplete : () => false;
			const shouldPreserveMissingExistingTurn = typeof options.shouldPreserveMissingExistingTurn === "function" ? options.shouldPreserveMissingExistingTurn : () => false;
			const sortTurnsForDisplay = typeof options.sortTurnsForDisplay === "function" ? options.sortTurnsForDisplay : defaultSortTurns;
			const threadHasInitialSubmissionEcho = typeof options.threadHasInitialSubmissionEcho === "function" ? options.threadHasInitialSubmissionEcho : () => false;
			const maxExpandedVisibleTurns = Math.max(1, Number(options.maxExpandedVisibleTurns || 200) || 200);
			function normalizeMergedThread(thread, limit = 0) {
				const normalized = normalizeThreadVisibleUserMessages(thread);
				if (normalized && Array.isArray(normalized.turns)) {
					const sorted = sortTurnsForDisplay(normalized.turns);
					normalized.turns = limit > 0 ? sorted.slice(-limit) : sorted;
				}
				return normalized;
			}
			function shouldPreserveLiveTurnLocalVisibleItems(existingTurn, incomingTurn, existingWeight = null) {
				return shouldPreserveExistingTurnVisibleItems(existingTurn, incomingTurn, existingWeight);
			}
			function mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) {
				if (!existingTurn) return incomingTurn;
				if (!incomingTurn) return existingTurn;
				const existingItems = Array.isArray(existingTurn.items) ? existingTurn.items : [];
				const incomingHasItems = Array.isArray(incomingTurn.items);
				const merged = Object.assign({}, existingTurn, incomingTurn);
				if (!incomingHasItems) {
					merged.items = existingItems;
					return merged;
				}
				const incomingWeight = turnVisibleWeight(Object.assign({}, incomingTurn, { items: incomingTurn.items || [] }));
				const existingWeight = turnVisibleWeight(existingTurn);
				const preserveLocalVisible = incomingWeight < existingWeight || shouldPreserveLiveTurnLocalVisibleItems(existingTurn, incomingTurn, existingWeight);
				merged.items = mergeItemsPreservingLocalVisible(existingItems, incomingTurn.items || [], preserveLocalVisible, incomingTurn);
				return merged;
			}
			function mergeThreadPreservingVisibleItems(existingThread, incomingThread, runtime = {}) {
				if (isV4ProjectionThread(incomingThread)) return mergeV4ProjectionThread(existingThread, incomingThread);
				if (!existingThread || !incomingThread || existingThread.id !== incomingThread.id) return normalizeMergedThread(incomingThread);
				const existingTurns = Array.isArray(existingThread.turns) ? existingThread.turns : [];
				const incomingTurns = Array.isArray(incomingThread.turns) ? incomingThread.turns : null;
				const existingById = new Map(existingTurns.map((turn) => [turn && turn.id, turn]).filter(([id]) => id));
				const initialSubmissionId = String(existingThread.mobileInitialSubmissionId || "");
				const merged = Object.assign({}, existingThread, incomingThread);
				if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoading")) delete merged.mobileLoading;
				if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileLoadError")) delete merged.mobileLoadError;
				if (!Object.prototype.hasOwnProperty.call(incomingThread, "mobileReadWarning")) delete merged.mobileReadWarning;
				if (!incomingTurns) return normalizeMergedThread(merged);
				const existingVisibleWeight = existingTurns.reduce((total, turn) => total + turnVisibleWeight(turn), 0);
				const incomingVisibleWeight = incomingTurns.reduce((total, turn) => total + turnVisibleWeight(turn), 0);
				const incomingHasAuthoritativeVisibleWindow = incomingTurns.length > 0 && incomingVisibleWeight > 0;
				if (!incomingTurns.length && existingTurns.length && existingVisibleWeight > 0 && incomingVisibleWeight === 0) {
					merged.turns = existingTurns;
					return normalizeMergedThread(merged);
				}
				merged.turns = incomingTurns.map((incomingTurn) => {
					const existingTurn = existingById.get(incomingTurn && incomingTurn.id);
					return existingTurn ? mergeTurnPreservingVisibleItems(existingTurn, incomingTurn) : incomingTurn;
				});
				merged.turns = sortTurnsForDisplay(merged.turns);
				const incomingIds = new Set(merged.turns.map((turn) => turn && turn.id).filter(Boolean));
				const latestIncoming = merged.turns.length ? merged.turns[merged.turns.length - 1] : null;
				const preserveExpandedHistory = Boolean(existingThread.mobileHistoryExpanded) && (/turns-list/i.test(String(incomingThread.mobileReadMode || "")) || Boolean(incomingThread.mobileOlderTurnsCursor) || Number(incomingThread.mobileOmittedTurnCount || 0) > 0);
				let preservedExpandedTurnCount = 0;
				const activeTurnId = String(runtime.activeTurnId || "");
				for (const existingTurn of existingTurns) {
					if (!existingTurn || incomingIds.has(existingTurn.id)) continue;
					if (shouldDropInitialSubmissionEchoTurn(existingTurn, merged.turns, initialSubmissionId)) continue;
					if (preserveExpandedHistory) {
						merged.turns.push(existingTurn);
						preservedExpandedTurnCount += 1;
						continue;
					}
					if (incomingHasAuthoritativeVisibleWindow && !shouldPreserveMissingExistingTurn(existingTurn, merged, runtime)) continue;
					if (turnIsSupersededBy(existingTurn, latestIncoming)) continue;
					if (String(existingTurn.id || "") === activeTurnId || !isTurnComplete(existingTurn) && turnVisibleWeight(existingTurn) > 0) merged.turns.push(existingTurn);
				}
				if (preserveExpandedHistory) {
					merged.mobileHistoryExpanded = true;
					if (preservedExpandedTurnCount > 0) merged.mobileOmittedTurnCount = Math.max(0, Number(merged.mobileOmittedTurnCount || 0) - preservedExpandedTurnCount);
				}
				const normalized = normalizeMergedThread(merged, preserveExpandedHistory ? maxExpandedVisibleTurns : 0);
				if (!threadHasInitialSubmissionEcho(normalized, initialSubmissionId)) delete normalized.mobileInitialSubmissionId;
				return normalized;
			}
			return {
				mergeThreadPreservingVisibleItems,
				mergeTurnPreservingVisibleItems,
				shouldPreserveLiveTurnLocalVisibleItems
			};
		}
		return { createThreadDetailMergePolicy };
	});
}));
//#endregion
//#region public/client-render-stability-guard.js
var require_client_render_stability_guard = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function initClientRenderStabilityGuard(globalScope) {
		function stringValue(value) {
			return String(value || "").trim();
		}
		function shortHash(value) {
			const text = stringValue(value);
			let hash = 2166136261;
			for (let index = 0; index < text.length; index += 1) {
				hash ^= text.charCodeAt(index);
				hash = Math.imul(hash, 16777619);
			}
			return (hash >>> 0).toString(36);
		}
		function submittedUserItemClientSubmissionId(item) {
			if (!item || item.type !== "userMessage") return "";
			return stringValue(item.clientSubmissionId);
		}
		function firstSubmittedUserMessageClientSubmissionId(turn) {
			const items = Array.isArray(turn && turn.items) ? turn.items : [];
			for (const item of items) {
				const submissionId = submittedUserItemClientSubmissionId(item);
				if (submissionId) return submissionId;
			}
			return "";
		}
		function localSubmissionRenderKey(clientSubmissionId) {
			const submissionId = stringValue(clientSubmissionId);
			return submissionId ? `submitted:${shortHash(submissionId)}` : "";
		}
		function submittedTurnRenderKey(turn) {
			const explicit = stringValue(turn && turn.mobileLocalSubmissionRenderKey);
			if (explicit) return explicit;
			return localSubmissionRenderKey(firstSubmittedUserMessageClientSubmissionId(turn));
		}
		function stableTurnIdentity(turn) {
			return submittedTurnRenderKey(turn) || stringValue(turn && (turn.id || turn.startedAt)) || "turn";
		}
		function markSubmittedTurn(turn, clientSubmissionId) {
			if (!turn || typeof turn !== "object") return "";
			const key = localSubmissionRenderKey(clientSubmissionId);
			if (key) turn.mobileLocalSubmissionRenderKey = key;
			return key;
		}
		function transferSubmittedTurnIdentity(sourceTurn, targetTurn, clientSubmissionId) {
			if (!targetTurn || typeof targetTurn !== "object") return "";
			const key = submittedTurnRenderKey(sourceTurn) || submittedTurnRenderKey(targetTurn) || localSubmissionRenderKey(clientSubmissionId);
			if (key) targetTurn.mobileLocalSubmissionRenderKey = key;
			return key;
		}
		const api = {
			firstSubmittedUserMessageClientSubmissionId,
			localSubmissionRenderKey,
			markSubmittedTurn,
			shortHash,
			stableTurnIdentity,
			submittedTurnRenderKey,
			transferSubmittedTurnIdentity
		};
		if (typeof module !== "undefined" && module.exports) module.exports = api;
		globalScope.CodexClientRenderStabilityGuard = api;
	})(typeof globalThis !== "undefined" ? globalThis : window);
}));
//#endregion
//#region public/live-operation-dock-state.js
var require_live_operation_dock_state = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	(function(root, factory) {
		const api = factory();
		if (typeof module === "object" && module.exports) module.exports = api;
		else if (root) root.CodexLiveOperationDockState = api;
	})(typeof globalThis !== "undefined" ? globalThis : null, function() {
		const DEFAULT_MIN_VISIBLE_MS = 500;
		function normalizeMode(mode) {
			return String(mode || "") === "expanded" ? "expanded" : "compact";
		}
		function text(value) {
			return String(value || "");
		}
		function isCompletedStatusText(value) {
			return /completed|failed|cancel|error|interrupted/i.test(text(value));
		}
		function nowValue(value) {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : Date.now();
		}
		function containsBubble(html) {
			return text(html).includes("mobile-operation-bubble");
		}
		function containsSheet(html) {
			return text(html).includes("mobile-operation-sheet");
		}
		function rememberCompactBubble(input = {}) {
			const nowMs = nowValue(input.nowMs);
			const minVisibleMs = Math.max(0, Number(input.minVisibleMs || DEFAULT_MIN_VISIBLE_MS));
			const existingUntilMs = Number(input.existingVisibleUntilMs || 0);
			const html = text(input.html);
			const threadId = text(input.threadId);
			return {
				visibleUntilMs: Math.max(existingUntilMs, nowMs + minVisibleMs),
				html,
				threadId,
				recallHtml: html,
				recallThreadId: threadId,
				recallAtMs: nowMs
			};
		}
		function compactBubblePreservation(input = {}) {
			if (containsBubble(input.nextHtml)) return { preserve: false };
			if (input.liveTurnActive === false) return { preserve: false };
			const remainingMs = Number(input.visibleUntilMs || 0) - nowValue(input.nowMs);
			if (remainingMs <= 0) return { preserve: false };
			const savedThreadId = text(input.savedThreadId);
			if (!savedThreadId || savedThreadId !== text(input.currentThreadId)) return { preserve: false };
			const savedHtml = text(input.savedHtml);
			const dockHasBubble = Boolean(input.dockHasBubble);
			if (!dockHasBubble && !containsBubble(savedHtml)) return { preserve: false };
			return {
				preserve: true,
				remainingMs,
				patchSavedHtml: Boolean(savedHtml && !dockHasBubble),
				savedHtml
			};
		}
		function shouldPreservePinned(input = {}) {
			return Boolean(input.pinned && normalizeMode(input.mode) === "expanded" && text(input.pinnedThreadId) === text(input.currentThreadId) && input.dockHasSheet && input.liveTurnActive !== false && !containsBubble(input.nextHtml));
		}
		function shouldShowRecall(input = {}) {
			const recallThreadId = text(input.recallThreadId);
			return Boolean(input.isMobile && input.hasCurrentThread && !input.newThreadDraft && input.liveTurnActive !== false && recallThreadId && recallThreadId === text(input.currentThreadId) && containsSheet(input.recallHtml));
		}
		function operationCardContentPlan(input = {}) {
			const status = text(input.status || (input.completed ? "completed" : "running")).trim();
			const type = text(input.type || input.itemType || "item").trim() || "item";
			const title = text(input.title || type).trim() || type;
			const detail = text(input.detail).replace(/\s+/g, " ").trim();
			const durationText = text(input.durationText).trim();
			const extraClass = text(input.extraClass).trim();
			const completed = Boolean(input.completed || isCompletedStatusText(status));
			return {
				itemId: text(input.itemId).trim(),
				type,
				status,
				title,
				detail,
				detailEmpty: !detail,
				statusVisible: Boolean(status),
				durationVisible: Boolean(durationText),
				durationText,
				durationTitle: durationText ? `Elapsed ${durationText}` : "",
				durationAttrs: text(input.durationAttrs).trim(),
				classTokens: [
					"item",
					"live-operation",
					extraClass,
					completed ? "completed" : "",
					type
				].filter(Boolean)
			};
		}
		function htmlEscaper(input = {}) {
			return typeof input.escapeHtml === "function" ? input.escapeHtml : (value) => text(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
		}
		function durationAttributeHtml(value, escape) {
			const attrs = [];
			const input = text(value);
			const attrPattern = /\b(data-(?:started|completed|duration)-ms)="([^"]*)"/g;
			let match;
			while (match = attrPattern.exec(input)) attrs.push(`${match[1]}="${escape(match[2])}"`);
			return attrs.join(" ");
		}
		function operationCardHtml(input = {}) {
			const escape = htmlEscaper(input);
			const plan = input.plan || operationCardContentPlan(input);
			const renderKey = text(input.renderKey || input.key).trim();
			const durationAttrs = durationAttributeHtml(plan.durationAttrs, escape);
			const duration = plan.durationVisible ? `<time class="operation-duration" ${durationAttrs} title="${escape(plan.durationTitle)}">${escape(plan.durationText)}</time>` : "";
			const classes = (Array.isArray(plan.classTokens) ? plan.classTokens : []).map(escape).join(" ");
			const detailValue = plan.detail ? escape(plan.detail) : "&nbsp;";
			const body = `<div class="operation-detail-line${plan.detailEmpty ? " empty" : ""}"><span class="operation-detail">${detailValue}</span></div>`;
			const statusHtml = plan.statusVisible ? `<span class="operation-status">${escape(plan.status)}</span>` : "";
			return `<section class="${classes}" data-item="${escape(plan.itemId)}" data-render-key="${escape(renderKey)}">
    <div class="operation-meta-line"><span class="operation-meta-main"><span class="operation-title">${escape(plan.title)}</span>${statusHtml}</span>${duration}</div>
    ${body}
  </section>`;
		}
		return {
			DEFAULT_MIN_VISIBLE_MS,
			compactBubblePreservation,
			containsBubble,
			containsSheet,
			normalizeMode,
			operationCardContentPlan,
			operationCardHtml,
			rememberCompactBubble,
			shouldPreservePinned,
			shouldShowRecall
		};
	});
}));
//#endregion
//#region \0virtual:codex-mobile-esm-compatibility
var import_build_refresh_policy = /* @__PURE__ */ __toESM(require_build_refresh_policy());
var import_runtime_settings = /* @__PURE__ */ __toESM(require_runtime_settings());
var import_viewport_metrics = /* @__PURE__ */ __toESM(require_viewport_metrics());
var import_draft_store = /* @__PURE__ */ __toESM(require_draft_store());
var import_thread_list_load_policy = /* @__PURE__ */ __toESM(require_thread_list_load_policy());
var import_thread_list_stable_order = /* @__PURE__ */ __toESM(require_thread_list_stable_order());
var import_thread_status_hints = /* @__PURE__ */ __toESM(require_thread_status_hints());
var import_thread_detail_patch_plan = /* @__PURE__ */ __toESM(require_thread_detail_patch_plan());
var import_thread_detail_merge_state = /* @__PURE__ */ __toESM(require_thread_detail_merge_state());
var import_client_render_stability_guard = /* @__PURE__ */ __toESM(require_client_render_stability_guard());
var import_live_operation_dock_state = /* @__PURE__ */ __toESM(require_live_operation_dock_state());
var moduleDefinitions = [
	{
		"id": "build-refresh-policy",
		"source": "public/build-refresh-policy.js",
		"globalName": "CodexBuildRefreshPolicy",
		"expectedFunctions": [
			"shellSequenceFromBuildId",
			"classifyServerBuildChange",
			"shouldPromptForServerBuildChange"
		],
		"assetPath": "/build-refresh-policy.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "runtime-settings",
		"source": "public/runtime-settings.js",
		"globalName": "CodexRuntimeSettings",
		"expectedFunctions": [
			"normalizeOptionList",
			"labelForModel",
			"compactLabelForModel",
			"labelForEffort",
			"labelForPermissionMode",
			"titleForPermissionMode",
			"normalizePermissionModeValue",
			"selectedNewThreadModel",
			"selectedNewThreadEffort",
			"selectedNewThreadPermission"
		],
		"assetPath": "/runtime-settings.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "viewport-metrics",
		"source": "public/viewport-metrics.js",
		"globalName": "CodexViewportMetrics",
		"expectedFunctions": [
			"cssPixel",
			"isKeyboardEditable",
			"measureViewport",
			"stablePixelChanged"
		],
		"assetPath": "/viewport-metrics.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "draft-store",
		"source": "public/draft-store.js",
		"globalName": "CodexDraftStore",
		"expectedFunctions": [
			"defaultNormalizeFsPath",
			"parseDraftMap",
			"draftHasContent",
			"normalizeAttachmentMeta",
			"attachmentStorageKey",
			"createDraftStore"
		],
		"assetPath": "/draft-store.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "thread-list-load-policy",
		"source": "public/thread-list-load-policy.js",
		"globalName": "CodexThreadListLoadPolicy",
		"expectedFunctions": ["planThreadListLoadRequest"],
		"assetPath": "/thread-list-load-policy.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "thread-list-stable-order",
		"source": "public/thread-list-stable-order.js",
		"globalName": "CodexThreadListStableOrder",
		"expectedFunctions": ["threadListOrderScopeKey", "planThreadListStableOrder"],
		"assetPath": "/thread-list-stable-order.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "thread-status-hints",
		"source": "public/thread-status-hints.js",
		"globalName": "CodexThreadStatusHints",
		"expectedFunctions": [
			"isRunningStatus",
			"shouldExpireRunningThreadHint",
			"shouldMarkThreadUnread"
		],
		"assetPath": "/thread-status-hints.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "thread-detail-patch-plan",
		"source": "public/thread-detail-patch-plan.js",
		"globalName": "CodexThreadDetailPatchPlan",
		"expectedFunctions": [
			"planThreadDetailDomPatchSurface",
			"planThreadDetailRefreshDomPatch",
			"planVisibleItemRefreshPatch"
		],
		"assetPath": "/thread-detail-patch-plan.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "thread-detail-merge-state",
		"source": "public/thread-detail-merge-state.js",
		"globalName": "CodexThreadDetailMergeState",
		"expectedFunctions": ["createThreadDetailMergePolicy"],
		"assetPath": "/thread-detail-merge-state.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "client-render-stability-guard",
		"source": "public/client-render-stability-guard.js",
		"globalName": "CodexClientRenderStabilityGuard",
		"expectedFunctions": [
			"firstSubmittedUserMessageClientSubmissionId",
			"localSubmissionRenderKey",
			"markSubmittedTurn",
			"shortHash",
			"stableTurnIdentity",
			"submittedTurnRenderKey",
			"transferSubmittedTurnIdentity"
		],
		"assetPath": "/client-render-stability-guard.js",
		"classicLoaderExcluded": true
	},
	{
		"id": "live-operation-dock-state",
		"source": "public/live-operation-dock-state.js",
		"globalName": "CodexLiveOperationDockState",
		"expectedFunctions": [
			"compactBubblePreservation",
			"operationCardContentPlan",
			"shouldShowRecall"
		],
		"assetPath": "/live-operation-dock-state.js",
		"classicLoaderExcluded": true
	}
];
var moduleApis = {
	"build-refresh-policy": import_build_refresh_policy.default,
	"runtime-settings": import_runtime_settings.default,
	"viewport-metrics": import_viewport_metrics.default,
	"draft-store": import_draft_store.default,
	"thread-list-load-policy": import_thread_list_load_policy.default,
	"thread-list-stable-order": import_thread_list_stable_order.default,
	"thread-status-hints": import_thread_status_hints.default,
	"thread-detail-patch-plan": import_thread_detail_patch_plan.default,
	"thread-detail-merge-state": import_thread_detail_merge_state.default,
	"client-render-stability-guard": import_client_render_stability_guard.default,
	"live-operation-dock-state": import_live_operation_dock_state.default
};
function functionReady(api, name) {
	return Boolean(api && typeof api[name] === "function");
}
function publishClassicGlobal(definition, api) {
	const globalName = String(definition && definition.globalName || "");
	if (!globalName || !api || typeof api !== "object" || typeof globalThis === "undefined") return false;
	globalThis[globalName] = api;
	return globalThis[globalName] === api;
}
function sampleModule(id, api) {
	if (id === "build-refresh-policy") {
		const classification = functionReady(api, "classifyServerBuildChange") ? api.classifyServerBuildChange("0.1.11|codex-mobile-shell-v626", "0.1.11|codex-mobile-shell-v625") : "";
		const prompt = functionReady(api, "shouldPromptForServerBuildChange") ? api.shouldPromptForServerBuildChange("0.1.11|codex-mobile-shell-v626", "0.1.11|codex-mobile-shell-v625") : false;
		return {
			ok: classification === "server-newer" && prompt === true,
			classification,
			prompt
		};
	}
	if (id === "runtime-settings") {
		const normalizedOptions = functionReady(api, "normalizeOptionList") ? api.normalizeOptionList([
			"",
			"gpt-5.5",
			" gpt-5.5 ",
			"gpt-5.4"
		]) : [];
		const modelLabel = functionReady(api, "labelForModel") ? api.labelForModel("gpt-5.3-codex-spark") : "";
		const compactModelLabel = functionReady(api, "compactLabelForModel") ? api.compactLabelForModel("gpt-5.3-codex-spark") : "";
		const effortLabel = functionReady(api, "labelForEffort") ? api.labelForEffort("xhigh") : "";
		const permissionLabel = functionReady(api, "labelForPermissionMode") ? api.labelForPermissionMode("full") : "";
		const permissionTitle = functionReady(api, "titleForPermissionMode") ? api.titleForPermissionMode("custom") : "";
		const permissionAlias = functionReady(api, "normalizePermissionModeValue") ? api.normalizePermissionModeValue("full-access") : "";
		const selectedModel = functionReady(api, "selectedNewThreadModel") ? api.selectedNewThreadModel({
			selected: "",
			defaultValue: "gpt-5.5",
			options: ["gpt-5.4"]
		}) : "";
		const selectedEffort = functionReady(api, "selectedNewThreadEffort") ? api.selectedNewThreadEffort({
			selected: " high ",
			defaultValue: "medium",
			options: ["low"]
		}) : "";
		const selectedPermission = functionReady(api, "selectedNewThreadPermission") ? api.selectedNewThreadPermission({
			selected: "workspace-write",
			defaultValue: "full",
			options: ["auto"]
		}) : "";
		return {
			ok: Array.isArray(normalizedOptions) && normalizedOptions.join(",") === "gpt-5.5,gpt-5.4" && modelLabel === "GPT-5.3 Codex Spark" && compactModelLabel === "5.3 Spark" && effortLabel === "XHigh" && permissionLabel === "完全访问权限" && permissionTitle === "自定义 (config.toml)" && permissionAlias === "full" && selectedModel === "gpt-5.5" && selectedEffort === "high" && selectedPermission === "auto",
			normalizedOptions,
			modelLabel,
			compactModelLabel,
			effortLabel,
			permissionLabel,
			permissionTitle,
			permissionAlias,
			selectedModel,
			selectedEffort,
			selectedPermission
		};
	}
	if (id === "viewport-metrics") {
		const editable = functionReady(api, "isKeyboardEditable") ? api.isKeyboardEditable({
			tagName: "INPUT",
			type: "text"
		}) : false;
		const checkboxEditable = functionReady(api, "isKeyboardEditable") ? api.isKeyboardEditable({
			tagName: "INPUT",
			type: "checkbox"
		}) : true;
		const measurement = functionReady(api, "measureViewport") ? api.measureViewport({
			visualHeight: 520,
			visualOffsetTop: 16,
			innerHeight: 1024,
			clientHeight: 1024,
			activeElement: { tagName: "TEXTAREA" }
		}) : {};
		const stableChanged = functionReady(api, "stablePixelChanged") ? api.stablePixelChanged(92, 94) : false;
		const stableNoise = functionReady(api, "stablePixelChanged") ? api.stablePixelChanged(92, 93) : true;
		const cssPixel = functionReady(api, "cssPixel") ? api.cssPixel(92.6) : 0;
		return {
			ok: editable === true && checkboxEditable === false && measurement.keyboardShrunk === true && measurement.height === 520 && measurement.top === 16 && stableChanged === true && stableNoise === false && cssPixel === 93,
			editable,
			checkboxEditable,
			keyboardShrunk: Boolean(measurement.keyboardShrunk),
			height: Number(measurement.height) || 0,
			top: Number(measurement.top) || 0,
			stableChanged,
			stableNoise,
			cssPixel
		};
	}
	if (id === "draft-store") {
		const memory = /* @__PURE__ */ new Map();
		const store = functionReady(api, "createDraftStore") ? api.createDraftStore({
			storage: {
				getItem(key) {
					return memory.has(key) ? memory.get(key) : null;
				},
				setItem(key, value) {
					memory.set(key, String(value));
				},
				removeItem(key) {
					memory.delete(key);
				}
			},
			maxDrafts: 2
		}) : null;
		if (store && typeof store.writeMap === "function") {
			store.writeMap({
				old: {
					text: "old",
					updatedAt: 1
				},
				newest: {
					text: "newest",
					updatedAt: 3
				},
				middle: {
					text: "middle",
					updatedAt: 2
				}
			});
			store.setTargetKey("new:/repo");
		}
		const draftKeys = store && typeof store.readMap === "function" ? Object.keys(store.readMap()) : [];
		const threadKey = store && typeof store.keyForThread === "function" ? store.keyForThread(" abc ") : "";
		const newThreadKey = store && typeof store.keyForNewThread === "function" ? store.keyForNewThread("C:/Users/xuefu/project/") : "";
		const targetKey = store && typeof store.getTargetKey === "function" ? store.getTargetKey() : "";
		const parsed = functionReady(api, "parseDraftMap") ? api.parseDraftMap("{\"a\":{\"text\":\"draft\"}}") : {};
		const hasContent = functionReady(api, "draftHasContent") ? api.draftHasContent({ permissionMode: "full" }) : false;
		const meta = functionReady(api, "normalizeAttachmentMeta") ? api.normalizeAttachmentMeta({
			id: 7,
			file: {
				name: "screenshot.png",
				type: "image/png",
				size: 42,
				lastModified: 123
			}
		}) : null;
		const attachmentKey = functionReady(api, "attachmentStorageKey") ? api.attachmentStorageKey("new:/a b", "x/y") : "";
		const normalizedPath = functionReady(api, "defaultNormalizeFsPath") ? api.defaultNormalizeFsPath("C:/Users/xuefu/project/") : "";
		return {
			ok: threadKey === "thread:abc" && newThreadKey === "new:c:\\users\\xuefu\\project" && targetKey === "new:/repo" && draftKeys.join(",") === "newest,middle" && parsed && parsed.a && parsed.a.text === "draft" && hasContent === true && meta && meta.id === "7" && meta.size === 42 && attachmentKey === "new%3A%2Fa%20b|x%2Fy" && normalizedPath === "c:\\users\\xuefu\\project",
			threadKey,
			newThreadKey,
			targetKey,
			draftKeys,
			hasContent,
			attachmentKey,
			normalizedPath
		};
	}
	if (id === "thread-list-load-policy") {
		const plan = functionReady(api, "planThreadListLoadRequest") ? api.planThreadListLoadRequest({
			silent: true,
			threadDetailOpening: true,
			deferFallback: true
		}) : {};
		return {
			ok: plan && plan.action === "thread-list-load-request" && plan.shouldLoad === false && plan.skipReason === "detail-in-flight" && plan.retryDelayMs === 700,
			action: String(plan && plan.action || ""),
			shouldLoad: Boolean(plan && plan.shouldLoad),
			skipReason: String(plan && plan.skipReason || ""),
			retryDelayMs: Number(plan && plan.retryDelayMs) || 0
		};
	}
	if (id === "thread-list-stable-order") {
		const scopeKey = functionReady(api, "threadListOrderScopeKey") ? api.threadListOrderScopeKey({
			selectedCwd: "/tmp/project",
			search: "Home"
		}) : "";
		const plan = functionReady(api, "planThreadListStableOrder") ? api.planThreadListStableOrder({
			threads: [
				{ id: "b" },
				{ id: "a" },
				{ id: "c" }
			],
			previousState: {
				scopeKey,
				holdUntilMs: 2e3,
				order: ["a", "b"]
			},
			scopeKey,
			nowMs: 1e3,
			holdMs: 5e3
		}) : {};
		const order = Array.isArray(plan.order) ? plan.order : [];
		return {
			ok: scopeKey === JSON.stringify({
				cwd: "/tmp/project",
				search: "home"
			}) && plan.held === true && order.join(",") === "a,b,c",
			scopeKey,
			held: Boolean(plan.held),
			order
		};
	}
	if (id === "thread-status-hints") {
		const running = functionReady(api, "isRunningStatus") ? api.isRunningStatus("in_progress") : false;
		const unread = functionReady(api, "shouldMarkThreadUnread") ? api.shouldMarkThreadUnread({
			threadId: "target-thread",
			currentThreadId: "other-thread",
			status: "completed",
			thread: { turns: [{
				status: "completed",
				completedAtMs: 2e3
			}] },
			viewedAtMs: 1e3
		}) : false;
		const expire = functionReady(api, "shouldExpireRunningThreadHint") ? api.shouldExpireRunningThreadHint({
			threadId: "target-thread",
			isRunningHinted: true,
			status: "idle",
			runningHintedAtMs: 0,
			runningHintStaleMs: 1e3,
			nowMs: 5e3,
			thread: {}
		}) : false;
		return {
			ok: running === true && unread === true && expire === true,
			running,
			unread,
			expire
		};
	}
	if (id === "thread-detail-patch-plan") {
		const surface = functionReady(api, "planThreadDetailDomPatchSurface") ? api.planThreadDetailDomPatchSurface({
			threadId: "thread-a",
			conversationPresent: true
		}) : {};
		const visiblePatch = functionReady(api, "planVisibleItemRefreshPatch") ? api.planVisibleItemRefreshPatch([{
			key: "a",
			signature: "1"
		}], [{
			key: "a",
			signature: "1"
		}, {
			key: "b",
			signature: "2"
		}]) : {};
		const turnPatch = functionReady(api, "planThreadDetailRefreshDomPatch") ? api.planThreadDetailRefreshDomPatch([{
			key: "turn-a",
			hasPreviousTurn: true,
			itemPatchable: true,
			articlePresent: true
		}]) : {};
		const visibleOperations = Array.isArray(visiblePatch.operations) ? visiblePatch.operations : [];
		const turnOperations = Array.isArray(turnPatch.operations) ? turnPatch.operations : [];
		return {
			ok: surface.canPatch === true && surface.reason === "single-thread-surface" && visiblePatch.canPatch === true && visibleOperations.map((entry) => entry.type).join(",") === "reuse,insert" && turnPatch.canPatch === true && turnOperations.length === 1 && turnOperations[0].type === "item-patch",
			surfaceReason: String(surface.reason || ""),
			visibleOperationCount: visibleOperations.length,
			turnOperationType: String(turnOperations[0] && turnOperations[0].type || "")
		};
	}
	if (id === "thread-detail-merge-state") {
		const policy = functionReady(api, "createThreadDetailMergePolicy") ? api.createThreadDetailMergePolicy({
			sortTurnsForDisplay: (turns) => Array.isArray(turns) ? turns.slice().sort((left, right) => String(left && left.id || "").localeCompare(String(right && right.id || ""))) : [],
			turnVisibleWeight: (turn) => JSON.stringify(turn && turn.items || []).length,
			mergeItemsPreservingLocalVisible: (existingItems, incomingItems, preserveLocalVisible) => preserveLocalVisible ? existingItems : incomingItems
		}) : {};
		const merged = policy && typeof policy.mergeThreadPreservingVisibleItems === "function" ? policy.mergeThreadPreservingVisibleItems({
			id: "thread-a",
			turns: [{
				id: "b",
				items: [{
					type: "assistantMessage",
					text: "full receipt"
				}]
			}]
		}, {
			id: "thread-a",
			turns: [{
				id: "b",
				items: []
			}, {
				id: "a",
				items: [{
					type: "userMessage",
					text: "hello"
				}]
			}]
		}) : {};
		const turns = Array.isArray(merged && merged.turns) ? merged.turns : [];
		const preserved = turns.find((turn) => turn && turn.id === "b");
		return {
			ok: turns.map((turn) => String(turn && turn.id || "")).join(",") === "a,b" && Array.isArray(preserved && preserved.items) && preserved.items.length === 1 && preserved.items[0].text === "full receipt",
			turnOrder: turns.map((turn) => String(turn && turn.id || "")),
			preservedItemCount: Array.isArray(preserved && preserved.items) ? preserved.items.length : 0
		};
	}
	if (id === "client-render-stability-guard") {
		const sourceTurn = {
			id: "local-turn-secret",
			items: [{
				type: "userMessage",
				clientSubmissionId: "submission-secret",
				mobilePendingSubmission: true
			}]
		};
		const targetTurn = {
			id: "server-turn-a",
			items: [{
				type: "userMessage",
				clientSubmissionId: "submission-secret"
			}]
		};
		const sourceKey = functionReady(api, "markSubmittedTurn") ? api.markSubmittedTurn(sourceTurn, "submission-secret") : "";
		const transferredKey = functionReady(api, "transferSubmittedTurnIdentity") ? api.transferSubmittedTurnIdentity(sourceTurn, targetTurn, "submission-secret") : "";
		const sourceIdentity = functionReady(api, "stableTurnIdentity") ? api.stableTurnIdentity(sourceTurn) : "";
		const targetIdentity = functionReady(api, "stableTurnIdentity") ? api.stableTurnIdentity(targetTurn) : "";
		return {
			ok: Boolean(sourceKey) && sourceKey === transferredKey && sourceIdentity === sourceKey && targetIdentity === sourceKey && !String(sourceKey).includes("submission-secret"),
			sourceKey: String(sourceKey || ""),
			transferredKey: String(transferredKey || ""),
			sourceIdentity: String(sourceIdentity || ""),
			targetIdentity: String(targetIdentity || "")
		};
	}
	if (id === "live-operation-dock-state") {
		const card = functionReady(api, "operationCardContentPlan") ? api.operationCardContentPlan({
			itemId: "op-a",
			type: "tool",
			status: "running",
			title: "Run",
			detail: "working",
			durationText: "1s"
		}) : {};
		const preserve = functionReady(api, "compactBubblePreservation") ? api.compactBubblePreservation({
			nextHtml: "",
			liveTurnActive: true,
			visibleUntilMs: 2e3,
			nowMs: 1e3,
			savedThreadId: "thread-a",
			currentThreadId: "thread-a",
			savedHtml: "<div class=\"mobile-operation-bubble\"></div>",
			dockHasBubble: false
		}) : {};
		const recall = functionReady(api, "shouldShowRecall") ? api.shouldShowRecall({
			isMobile: true,
			hasCurrentThread: true,
			newThreadDraft: false,
			liveTurnActive: true,
			recallThreadId: "thread-a",
			currentThreadId: "thread-a",
			recallHtml: "<div class=\"mobile-operation-sheet\"></div>"
		}) : false;
		const classTokens = Array.isArray(card.classTokens) ? card.classTokens : [];
		return {
			ok: card.detail === "working" && classTokens.includes("live-operation") && preserve.preserve === true && preserve.patchSavedHtml === true && recall === true,
			detail: String(card.detail || ""),
			preserve: Boolean(preserve.preserve),
			recall
		};
	}
	return { ok: false };
}
function codexMobileViteEsmCompatibility() {
	const modules = moduleDefinitions.map((definition) => {
		const api = moduleApis[definition.id] && typeof moduleApis[definition.id] === "object" ? moduleApis[definition.id] : {};
		const expectedFunctions = Array.isArray(definition.expectedFunctions) ? definition.expectedFunctions : [];
		const exportedFunctions = expectedFunctions.filter((name) => functionReady(api, name));
		const sample = sampleModule(definition.id, api);
		const globalPublished = publishClassicGlobal(definition, api);
		return {
			id: definition.id,
			source: definition.source,
			assetPath: definition.assetPath,
			globalName: definition.globalName,
			classicLoaderExcluded: definition.classicLoaderExcluded === true,
			expectedFunctions: expectedFunctions.slice(),
			exportedFunctions,
			sample,
			globalPublished,
			ready: exportedFunctions.length === expectedFunctions.length && sample.ok === true && (definition.classicLoaderExcluded !== true || globalPublished === true)
		};
	});
	return {
		schemaVersion: 1,
		owner: "vite-shell-entry",
		moduleCount: modules.length,
		readyCount: modules.filter((entry) => entry.ready === true).length,
		modules
	};
}
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
	"manifest": () => __vitePreload(() => import("./vite-entry-group-manifest-B1n76OzZ.js"), []),
	"foundation": () => __vitePreload(() => import("./vite-entry-group-foundation-B1IKmadt.js"), []),
	"feature-runtimes": () => __vitePreload(() => import("./vite-entry-group-feature-runtimes-DA8rmK4C.js"), []),
	"bootstrap-state": () => __vitePreload(() => import("./vite-entry-group-bootstrap-state-DKvl11uE.js"), []),
	"shell-services": () => __vitePreload(() => import("./vite-entry-group-shell-services-BGVOJSIU.js"), []),
	"app-entry": () => __vitePreload(() => import("./vite-entry-group-app-entry-9WxAQ_0R.js"), [])
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
var esmCompatibility = codexMobileViteEsmCompatibility();
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
	const coveredAssets = /* @__PURE__ */ new Set([...assets, ...excludedEsmAssets]);
	const manifestCoverageMatches = manifestAssets.length > 0 && coveredAssets.size === manifestAssets.length && JSON.stringify(manifestAssets.filter((asset) => coveredAssets.has(asset))) === JSON.stringify(manifestAssets);
	const missingExcludedGlobals = loaderPlan && Array.isArray(loaderPlan.excludedEsmScripts) ? loaderPlan.excludedEsmScripts.filter((entry) => !entry.globalName || !globalThis[entry.globalName]).map((entry) => entry.globalName || entry.path) : [];
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
		loaderPlanSha256: loaderPlan ? loaderPlan.sha256 : "",
		loaderPlanMatchesShellManifest: Boolean(loaderPlan) && manifestCoverageMatches,
		excludedEsmGlobalMissing: missingExcludedGlobals,
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
		if (loaderPlan.owner !== "vite-shell-entry" || !loaderPlan.sha256 || Number(loaderPlan.sourceScriptCount) !== manifestAssets.length || Number(loaderPlan.scriptCount) !== assets.length || Number(loaderPlan.hashCount) !== assets.length || Number(loaderPlan.excludedEsmScriptCount) !== excludedEsmAssets.length || Number(loaderPlan.excludedEsmHashCount) !== excludedEsmAssets.length || !manifestCoverageMatches) throw new Error("codex_mobile_vite_app_preview_loader_plan_invalid");
		if (missingExcludedGlobals.length) throw new Error("codex_mobile_vite_app_preview_esm_globals_missing");
		for (const asset of assets) {
			await loadClassicScript(asset);
			status.loaded.push(asset);
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
		loaderPlanSha256: status.loaderPlanSha256,
		loaderPlanMatchesShellManifest: status.loaderPlanMatchesShellManifest,
		excludedEsmGlobalMissingCount: status.excludedEsmGlobalMissing.length,
		scriptCount: status.scriptCount,
		loadedCount: status.loaded.length,
		failedCount: status.failed.length
	};
}
var deferredEntryTopologyPromise = __vitePreload(() => import("./vite-deferred-entry-topology-ULtIOTXk.js"), []);
loadCodexMobileViteEntryGroups();
var entryDynamicImportGraph = {
	owner: "vite-shell-entry",
	deferredSources: ["frontend/vite-deferred-entry-topology.mjs"],
	entryGroupSources: codexMobileViteEntryGroupIds.map((groupId) => `virtual:codex-mobile-shell-entry-group/${groupId}`),
	expectedImportCount: 1 + codexMobileViteEntryGroupIds.length
};
var appPreviewPromise = isAppPreviewPage() ? startCodexMobileViteAppPreview() : Promise.resolve(null);
globalThis.__CODEX_MOBILE_VITE_SHELL_BUILD_STAGE__ = "entry-topology-v1";
globalThis.__CODEX_MOBILE_VITE_SHELL_ENTRY_TOPOLOGY__ = entryTopology;
globalThis.__CODEX_MOBILE_VITE_CLASSIC_COMPATIBILITY__ = classicCompatibility;
globalThis.__CODEX_MOBILE_VITE_ESM_COMPATIBILITY__ = esmCompatibility;
globalThis.__CODEX_MOBILE_VITE_DEFERRED_ENTRY_TOPOLOGY__ = deferredEntryTopologyPromise;
globalThis.__CODEX_MOBILE_VITE_ENTRY_GROUP_IMPORT_OWNER__ = "vite-shell-entry";
globalThis.__CODEX_MOBILE_VITE_ENTRY_DYNAMIC_IMPORT_GRAPH__ = entryDynamicImportGraph;
globalThis.__CODEX_MOBILE_VITE_APP_PREVIEW_PROMISE__ = appPreviewPromise;
//#endregion
export { shell_asset_manifest_default as t };
